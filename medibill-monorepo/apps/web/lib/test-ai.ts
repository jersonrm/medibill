import { medibillAI } from "./gemini";

async function probarIA() {
  console.log("🚀 Iniciando prueba de Medibill IA...");
  
  // Un caso real que un médico podría escribir
  const notaMedica = "Paciente de 45 años, agricultor de La Cocha. Viene por dolor lumbar crónico muy fuerte. Le hice una consulta de primera vez por especialista y le ordené una sesión de fisioterapia.";

  try {
    console.log("Procesando la nota médica...");
    const result = await medibillAI.generateContent(notaMedica);
    const response = await result.response;
    const text = response.text();
    
    console.log("\n✅ Respuesta de Gemini (JSON Estructurado):");
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  }
}

probarIA();