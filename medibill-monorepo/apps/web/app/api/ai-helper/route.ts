import { helperAI } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const result = await helperAI.generateContent(
      `Busca los 5 códigos CUPS oficiales de Colombia más relevantes para: "${prompt}"`
    );
    const response = await result.response;
    const datos = JSON.parse(response.text());

    return NextResponse.json(datos);
  } catch (error) {
    console.error("Error en AI Helper:", error);
    return NextResponse.json({ opciones: [] }, { status: 500 });
  }
}