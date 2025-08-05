import * as cheerio from 'cheerio';

/**
 * Mocks a call to a Goodreads scraping service to get a user's read books.
 * In a real application, this would be a backend call to a web scraper.
 * @param {string} userId The Goodreads user ID.
 * @returns {string[]} An array of hardcoded book titles.
 */
export const getReadBooksDummy = (userId) => {
// This is a hardcoded list of books for demonstration.
// In a real-world app, a backend service would scrape Goodreads.
if (userId === '12345') {
    return [
    "Project Hail Mary",
    "Dune",
    "The Lord of the Rings",
    "The Name of the Wind",
    "The Martian",
    "Harry Potter and the Sorcerer's Stone",
    "The Hitchhiker's Guide to the Galaxy",
    "1984"
    ];
}
return [];
};

export const getReadBooks = async (userId) => {
  try {
    const response = await fetch(`/api/goodreads?userId=${encodeURIComponent(userId)}`);
    const data = await response.json();
    return data.titles || [];
  } catch (err) {
    console.error('Error fetching from backend:', err);
    return [];
  }
};

// export const getReadBooks = async (userId) => {
//   // Goodreads shelf URL
//   const url = `https://www.goodreads.com/review/list/${userId}?shelf=read`;

//   try {
//     const response = await fetch(url, {
//       credentials: 'omit', // Goodreads blocks CORS, so this only works server-side or with a proxy
//       headers: {
//         'Accept': 'text/html',
//       },
//     });
//     if (!response.ok) throw new Error('Failed to fetch Goodreads page');

//     const html = await response.text();

//     // Parse the HTML to extract book titles from the table
//     const parser = new DOMParser();
//     const doc = parser.parseFromString(html, 'text/html');
//     const rows = doc.querySelectorAll('table#books tbody tr.bookalike.review');
//     const titles = [];
//     rows.forEach(row => {
//       const titleCell = row.querySelector('td.field.title .value a');
//       if (titleCell) {
//         titles.push(titleCell.textContent.trim());
//       }
//     });
//     console.log('Scraped titles:', titles);
//     return titles;
//   } catch (err) {
//     console.error('Error scraping Goodreads:', err);
//     return [];
//   }
// };

/**
   * Fetches book details (image, URL) from the Google Books API.
   * @param {string} title The title of the book.
   * @returns {object} An object containing the book details, or null if not found.
   */
export const fetchBookDetailsFromGoogleBooks = async (title) => {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          imageUrl: item.volumeInfo.imageLinks?.thumbnail,
          url: item.volumeInfo.infoLink,
        };
      }
    } catch (err) {
      console.error('Error fetching from Google Books API:', err);
    }
    return null;
  };

// Add this function to search Google:
export async function googleSearch(query, apiKey, cx) {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.items || [];
}

export async function getGoodreadsData(bookTitle, author, searchApiKey, searchCx) {

    // Step 1: Search Google for the Goodreads page
    const searchQuery = `${bookTitle} ${author || ''} site:goodreads.com`;
    const searchResults = await googleSearch(searchQuery, searchApiKey, searchCx);

    let goodreadsUrl = null;
    // Find the first result that looks like a Goodreads book page
    if (searchResults && Array.isArray(searchResults)) {
        const bookResult = searchResults.find(r =>
            r.link &&
            r.link.includes('goodreads.com/book/show')
        );
        if (bookResult) {
            goodreadsUrl = bookResult.link;
        }
    }

    let rating = null;
    let reviewCount = null;
    let title = null;
    let imgUrl = null;

    if (goodreadsUrl) {
        // Step 2: Scrape the Goodreads page for rating, review count, title, and image
        try {
            const response = await fetch(goodreadsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0', // Some sites block bots without UA
                },
            });
            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract rating (new Goodreads UI)
            const ratingDiv = $('.RatingStatistics__rating[aria-hidden="true"]').first();
            if (ratingDiv.length) {
                rating = ratingDiv.text().trim();
            } else {
                // Fallback: try meta tag
                const metaRating = $('meta[itemprop="ratingValue"]').attr('content');
                if (metaRating) rating = metaRating;
            }

            // Extract review count (new Goodreads UI)
            let reviewText = $('.RatingStatistics__meta').first().text();
            if (reviewText) {
                const match = reviewText.match(/([\d,]+)\s+reviews/);
                if (match) {
                    reviewCount = match[1];
                }
            }
            // Fallback: try meta tag
            if (!reviewCount) {
                const metaReviews = $('meta[itemprop="reviewCount"]').attr('content');
                if (metaReviews) reviewCount = metaReviews;
            }

            // Extract title
            // Try meta tag first
            title = $('meta[property="og:title"]').attr('content');
            if (!title) {
                // Fallback: try <h1> or <h1 class="Text Text__title1">
                title = $('h1.Text__title1, h1').first().text().trim();
            }

            // Extract image url
            // Try og:image meta tag first
            imgUrl = $('meta[property="og:image"]').attr('content');
            if (!imgUrl) {
                // Fallback: try new Goodreads UI selector
                const img = $('.BookPage__rightCover img.ResponsiveImage').first();
                if (img.length) {
                    imgUrl = img.attr('src');
                }
            }
        } catch (err) {
            console.error('Error scraping Goodreads:', err);
        }
    }

    return { goodreadsUrl, rating, reviewCount, title, imgUrl };
}