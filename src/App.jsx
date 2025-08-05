import React, { useState, useEffect } from 'react';
import { getReadBooks, fetchBookDetailsFromGoogleBooks, getGoodreadsData } from   './helpers';

// Main App component
export default function App() {
  const [goodreadsId, setGoodreadsId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  const [currentQuote, setCurrentQuote] = useState('');
  const loadingQuotes = [
        "Today we’re all alike, all of us bound together by our shared apathy toward our work. That very apathy has become a passion. The one great collective passion of our time.\n~ Milan Kundera, Identity",
        "This idea that beauty is the horizon toward which all great art must march. I’ve never been interested in that.\n~ Kaveh Akbar, Martyr!",
        "The more you read, the more things you will know. The more that you learn, the more places you'll go.\n~ Dr. Seuss, I Can Read With My Eyes Shut!",
        "A reader lives a thousand lives before he dies... The man who never reads lives only one.\n~ George R.R. Martin, A Dance with Dragons",
        "Books are a uniquely portable magic.\n~ Stephen King, On Writing: A Memoir of the Craft"
      ];

  useEffect(() => {
      if (loading) {
        const randomIndex = Math.floor(Math.random() * loadingQuotes.length);
        setCurrentQuote(loadingQuotes[randomIndex]);
      }
    }, [loading]);
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
      const readBooks = await getReadBooks(goodreadsId);

      // 2. Convert the uploaded image to a base64 string.
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(imageFile);
      });

      // 3. Craft the prompt for the LLM.
      // const prompt = `
      //   You are an expert literary assistant. Your task is to analyze an image of a bookshelf, identify the books on it, and then recommend three books from that shelf that are NOT in the user's list of previously read books.

      //   The user's list of read books is: ${readBooks.join(', ')}.

      //   Please provide your response as a JSON array of objects. Each object should have a 'bookTitle' property (a string) and a 'summary' property (a one-line summary string explaining why the user might like this book). Do not include any other text or formatting outside the JSON array.
      //   Example response: [{ "bookTitle": "The Name of the Wind", "summary": "If you enjoy epic fantasy with a lyrical writing style, this is a must-read." }]
      //   If you cannot find any new books to recommend, return an empty array.
      // `;

      // 3. Craft the prompt for the LLM.
      const prompt = `
        You are an expert literary assistant. Your task is to analyze an image of a bookshelf, identify the books on it, and then recommend three books from that shelf that are NOT in the user's list of previously read books.

        The user's list of read books is: ${readBooks.join(', ')}.

        Please provide your response as a JSON array of objects. Each object should have a 'bookTitle' property (a string) and a 'goodreadsUrl' property (the URL to the book on Goodreads). Do not include any other text or formatting outside the JSON array.
        Example response: [{ "bookTitle": "The Name of the Wind", "goodreadsUrl": "https://www.goodreads.com/book/show/186074.The_Name_of_the_Wind" }]
        If you cannot find any new books to recommend, return an empty array.
      `;
      console.log('Prompt for LLM:', prompt);

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
          // responseMimeType: "application/json",
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
        },
        tools: [
          {
            googleSearch: {}
          }
        ]
      };

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const searchApiKey = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || process.env.VITE_GOOGLE_SEARCH_API_KEY;
      const searchCx = import.meta.env.VITE_GOOGLE_SEARCH_CX || process.env.VITE_GOOGLE_SEARCH_CX;

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
        // The LLM response is prefixed with "json```" and then the JSON content.
        let rawText = result.candidates[0].content.parts[0].text.trim();
        console.log(rawText);
        // Remove "json```" prefix and any trailing backticks
        if (rawText.startsWith('json')) {
          rawText = rawText.replace(/^json\s*```/i, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```json')) {
          rawText = rawText.replace(/^```json/i, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        let parsedJson;
        try {
          parsedJson = JSON.parse(rawText);
        } catch (err) {
          throw new Error('Failed to parse LLM response as JSON.');
        }

        // 6. Fetch additional details for each book from Google Books API
        const recommendationsWithDetails = await Promise.all(
          parsedJson.map(async (book) => {
            // const details = await fetchBookDetailsFromGoogleBooks(book.bookTitle);
            // Fetch Goodreads data (optional: pass author if available)
            const goodreads = await getGoodreadsData(book.bookTitle, book.author, searchApiKey, searchCx);
            return {
              ...book,
              // ...details,
              ...goodreads
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
                  <span className="flex flex-col items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm font-semibold">Getting Recommendations...</span>
                    <p className="text-white text-xs text-center mt-2 px-4 italic max-w-xs">{currentQuote}</p>
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
                    {book.imgUrl && (
                      <img
                        src={book.imgUrl}
                        alt={`Cover of ${book.bookTitle}`}
                        className="w-20 h-auto rounded-lg shadow-md flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://placehold.co/80x120/E2E8F0/A0AEC0?text=No+Cover";
                        }}
                      />
                    )}
                    <div className="flex-grow">
                      <h3 className="text-xl font-bold text-gray-800">{book.bookTitle || book.title}</h3>
                      <p className="text-sm text-gray-600 italic mt-1">{book.summary}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        {book.rating && (
                          <span className="text-yellow-600 font-semibold">
                            ⭐ {book.rating}
                          </span>
                        )}
                        {book.reviewCount && (
                          <span className="text-gray-500 text-sm">
                            {book.reviewCount} reviews
                          </span>
                        )}
                      </div>
                      {book.goodreadsUrl && (
                        <a
                          href={book.goodreadsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-green-700 transition duration-200"
                        >
                          View on Goodreads
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

