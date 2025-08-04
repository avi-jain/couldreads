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