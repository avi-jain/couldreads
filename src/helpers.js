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
    const response = await fetch(`/api/goodreads-user?userId=${encodeURIComponent(userId)}`);
    const data = await response.json();
    return data.titles || [];
  } catch (err) {
    console.error('Error fetching from backend:', err);
    return [];
  }
};

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

// search Google - not really used 
export async function googleSearch(query, apiKey, cx) {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.items || [];
}

export async function getGoodreadsData(bookTitle, author, searchApiKey, searchCx) {
    try {
    const params = new URLSearchParams({
      bookTitle,
      author: author || '',
      searchApiKey,
      searchCx,
    });
    const response = await fetch(`/api/goodreads-book?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Goodreads data from backend');
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching Goodreads data from backend:', err);
    return {
      goodreadsUrl: null,
      rating: null,
      reviewCount: null,
      title: null,
      imgUrl: null,
    };
  }
}