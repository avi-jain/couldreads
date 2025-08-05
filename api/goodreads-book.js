import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { bookTitle, author, searchApiKey, searchCx } = req.query;

  if (!bookTitle || !searchApiKey || !searchCx) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  // Step 1: Search Google for the Goodreads page
  const searchQuery = `${bookTitle} ${author || ''} site:goodreads.com`;
  const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${searchApiKey}&cx=${searchCx}`;

  try {
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    console.log('Google Search API response:', searchData);
    const items = searchData.items || [];
    const bookResult = items.find(
      (r) => r.link && r.link.includes('goodreads.com/book/show')
    );
    if (!bookResult) {
      return res.status(404).json({ error: 'Goodreads page not found' });
    }
    const goodreadsUrl = bookResult.link;

    // Step 2: Scrape the Goodreads page for rating, review count, title, and image
    const pageResponse = await fetch(goodreadsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await pageResponse.text();
    const $ = cheerio.load(html);

    // Extract rating
    let rating = $('.RatingStatistics__rating[aria-hidden="true"]').first().text().trim();
    if (!rating) {
      const metaRating = $('meta[itemprop="ratingValue"]').attr('content');
      if (metaRating) rating = metaRating;
    }

    // Extract review count
    let reviewCount = null;
    let reviewText = $('.RatingStatistics__meta').first().text();
    if (reviewText) {
      const match = reviewText.match(/([\d,]+)\s+reviews/);
      if (match) reviewCount = match[1];
    }
    if (!reviewCount) {
      const metaReviews = $('meta[itemprop="reviewCount"]').attr('content');
      if (metaReviews) reviewCount = metaReviews;
    }

    // Extract title
    let title = $('meta[property="og:title"]').attr('content');
    if (!title) {
      title = $('h1.Text__title1, h1').first().text().trim();
    }

    // Extract image url
    let imgUrl = $('meta[property="og:image"]').attr('content');
    if (!imgUrl) {
      const img = $('.BookPage__rightCover img.ResponsiveImage').first();
      if (img.length) imgUrl = img.attr('src');
    }

    res.status(200).json({
      goodreadsUrl,
      rating,
      reviewCount,
      title,
      imgUrl,
    });
  } catch (err) {
    console.error('Error fetching Goodreads info:', err);
    res.status(500).json({ error: 'Failed to fetch Goodreads info' });
  }
}