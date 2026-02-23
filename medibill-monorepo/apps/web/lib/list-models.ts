async function listarModelos() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ No se encontró la API Key. Revisa el archivo .env.local");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    console.log("🔍 Consultando la API de Google...");
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ Error de la API:", data.error.message);
      return;
    }

    console.log("\n✅ Modelos disponibles para generar contenido:\n");
    
    // Filtramos solo los que sirven para texto/JSON (generateContent)
    data.models
      .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
      .forEach((m: any) => {
        // Limpiamos el texto 'models/' del nombre para que sea fácil de copiar
        console.log(`- ${m.name.replace('models/', '')}`);
      });
      
  } catch (error) {
    console.error("❌ Error de red:", error);
  }
}

listarModelos();