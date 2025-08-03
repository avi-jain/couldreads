import { useState } from 'react';

// Main App component
export default function App() {
  const [goodreadsId, setGoodreadsId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  /**
   * Mocks a call to a Goodreads scraping service to get a user's read books.
   * In a real application, this would be a backend call to a web scraper.
   * @param {string} userId The Goodreads user ID.
   * @returns {string[]} An array of hardcoded book titles.
   */
  const getReadBooks = (userId) => {
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

  /**
   * Fetches book details (image, URL) from the Google Books API.
   * @param {string} title The title of the book.
   * @returns {object} An object containing the book details, or null if not found.
   */
  const fetchBookDetailsFromGoogleBooks = async (title) => {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1`);
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

  /**
   * Handles the form submission, processes the image, and gets recommendations from the LLM.
   * @param {Event} e The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setRecommendations([]);
    setError(null);

    if (!imageFile) {
      setError('Please upload an image of a bookshelf.');
      setLoading(false);
      return;
    }

    try {
      // 1. Get the mocked list of books the user has read.
      const readBooks = getReadBooks(goodreadsId);

      // 2. Convert the uploaded image to a base64 string.
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(imageFile);
      });

      // 3. Craft the prompt for the LLM.
      const prompt = `
        You are an expert literary assistant. Your task is to analyze an image of a bookshelf, identify the books on it, and then recommend three books from that shelf that are NOT in the user's list of previously read books.

        The user's list of read books is: ${readBooks.join(', ')}.

        Please provide your response as a JSON array of objects. Each object should have a 'bookTitle' property (a string) and a 'summary' property (a one-line summary string explaining why the user might like this book). Do not include any other text or formatting outside the JSON array.
        Example response: [{ "bookTitle": "The Name of the Wind", "summary": "If you enjoy epic fantasy with a lyrical writing style, this is a must-read." }]
        If you cannot find any new books to recommend, return an empty array.
      `;

      // 4. Set up the LLM API call payload with image and text.
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageFile.type,
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                bookTitle: { type: "STRING" },
                summary: { type: "STRING" }
              }
            }
          }
        }
      };

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      // 5. Make the API call with exponential backoff for retries.
      let response;
      const maxRetries = 5;
      let retries = 0;
      while (retries < maxRetries) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            break;
          } else if (response.status === 429) {
            // Exponential backoff for rate limiting
            const delay = Math.pow(2, retries) * 1000;
            console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            retries++;
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'API request failed');
          }
        } catch (err) {
          if (retries === maxRetries - 1) throw err;
          retries++;
        }
      }

      if (!response || !response.ok) {
        throw new Error('API request failed after multiple retries.');
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const parsedJson = JSON.parse(jsonString);

        // 6. Fetch additional details for each book from Google Books API
        const recommendationsWithDetails = await Promise.all(
          parsedJson.map(async (book) => {
            const details = await fetchBookDetailsFromGoogleBooks(book.bookTitle);
            return {
              ...book,
              ...details
            };
          })
        );
        setRecommendations(recommendationsWithDetails);
      } else {
        setError('No recommendations found. The LLM could not process the image.');
      }

    } catch (err) {
      console.error('Error during recommendation process:', err);
      setError('An error occurred while getting recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-2xl w-full">
        <h1 className="text-4xl font-serif font-bold text-center text-gray-800 mb-2">couldreads</h1>
        <p className="text-center text-gray-500 mb-8">
          Find your next favorite book from a bookshelf photo.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="goodreads-id" className="block text-gray-700 font-medium mb-1">
              Goodreads User ID (mocked)
            </label>
            <input
              type="text"
              id="goodreads-id"
              value={goodreadsId}
              onChange={(e) => setGoodreadsId(e.target.value)}
              placeholder="e.g., 12345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            />
          </div>

          <div>
            <label htmlFor="bookshelf-image" className="block text-gray-700 font-medium mb-1">
              Upload Bookshelf Image
            </label>
            <input
              type="file"
              id="bookshelf-image"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="w-full text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition duration-200"
            />
            {imageFile && (
              <p className="mt-2 text-sm text-gray-500">
                Selected: {imageFile.name}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading || !imageFile}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Getting Recommendations...
              </span>
            ) : (
              'Get Recommendations'
            )}
          </button>
        </form>

        {/* Results and Error Display */}
        {error && (
          <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Your Recommendations</h2>
            <ul className="space-y-6">
              {recommendations.map((book, index) => (
                <li key={index} className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200 flex items-center space-x-4">
                  {book.imageUrl && (
                    <img
                      src={book.imageUrl}
                      alt={`Cover of ${book.bookTitle}`}
                      className="w-20 h-auto rounded-lg shadow-md flex-shrink-0"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://placehold.co/80x120/E2E8F0/A0AEC0?text=No+Cover";
                      }}
                    />
                  )}
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold text-gray-800">{book.bookTitle}</h3>
                    <p className="text-sm text-gray-600 italic mt-1">{book.summary}</p>
                    {book.url && (
                      <a
                        href={book.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 bg-blue-500 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-600 transition duration-200"
                      >
                        View on Google Books
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

