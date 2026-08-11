const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "http://192.168.31.144:8000";

export async function analyzeClothing(imageUrl) {
  console.log(
    "CALLING BACKEND ANALYZE:",
    `${BACKEND_URL}/analyze-clothing`
  );

  console.log(
    "IMAGE URL SENT TO BACKEND:",
    imageUrl
  );

  const response = await fetch(
    `${BACKEND_URL}/analyze-clothing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
      }),
    }
  );

  console.log(
    "BACKEND RESPONSE STATUS:",
    response.status
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "BACKEND ERROR RESPONSE:",
      errorText
    );
    throw new Error(
      `AI analysis failed. Status: ${response.status}`
    );
  }

  const result = await response.json();

  console.log(
    "BACKEND ANALYSIS RESULT:",
    result
  );

  return result;
}
