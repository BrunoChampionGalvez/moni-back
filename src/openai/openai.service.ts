import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export interface ExtractedExpenseData {
  local: string;
  amount: number;
  bank: string;
  paymentMethod?: string;
  date?: string;
}

export interface CategorizedLocal {
  actualLocal: string;
  category: string;
}

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async extractExpenseFromEmail(
    htmlContent: string,
    subject: string,
    images?: string[],
  ): Promise<ExtractedExpenseData | null> {
    try {
      // Define the schema for structured output
      const ExpenseSchema = z.object({
        local: z.string(),
        amount: z.string(),
        bank: z.string(),
        paymentMethod: z.string().optional(),
        date: z.string().optional(),
      });

      // Build the input for the Responses API
      const input = `Asunto: ${subject}\n\nContenido HTML:\n${htmlContent}`;

      const response = await this.openai.responses.parse({
        model: 'gpt-5-mini',
        instructions: `Eres un asistente experto en extraer información de gastos de correos electrónicos de bancos peruanos (BBVA, BCP, Interbank, Scotiabank).
          
Tu tarea es extraer la siguiente información del HTML del correo:
- local: El nombre del establecimiento o comercio donde se realizó la compra.
- amount: El monto cargado (solo el número, sin símbolos de moneda)
- bank: El nombre del banco
- paymentMethod: El método de pago (tarjeta de crédito, débito, etc.) si está disponible
- date: La fecha de la transacción en formato ISO (YYYY-MM-DD) si está disponible

IMPORTANTE:
- Si el correo NO es sobre una transacción o gasto, deja los campos vacíos
- Extrae solo información de transacciones confirmadas, no de autorizaciones pendientes
- El amount debe ser un número positivo
- Muchas veces el nombre del establecimiento o comercio está abreviado o es confuso. Es sumamente necesario que realices una búsqueda en la web para identificar el nombre real del negocio y proveerlo tal cual aparece en la web. Para esto, puedes intentar deducir el nombre real a partir del nombre abreviado, y utilizar información contenido en el nombre abreviado que pueda ayudarte a buscar en la web, como la dirección, ciudad, etc. Es sumamente necesario que realices una búsqueda exhaustiva para encontrar el nombre real del negocio. De no encontrar el nombre real, colócale de nombre el nombre abreviado que aparece en el correo.`,
        input: input,
        tools: [
          { type: "web_search" },
        ],
        text: {
          format: zodTextFormat(ExpenseSchema as any, 'expense_info'),
        },
        temperature: 0.1,
        reasoning: { effort: 'high' }
      });

      const result = response.output_parsed;
      
      if (!result || !result.local || !result.amount) {
        return null;
      }

      return {
        local: result.local,
        amount: parseFloat(result.amount),
        bank: result.bank,
        paymentMethod: result.paymentMethod,
        date: result.date,
      };
    } catch (error) {
      console.error('Error extracting expense from email:', error);
      return null;
    }
  }

  async categorizeLocal(
    localName: string,
    country: string,
  ): Promise<string> {
    try {

      const response = await this.openai.responses.create({
        model: 'gpt-5-mini',
        instructions: `Eres un asistente experto en identificar negocios y categorizarlos.

Tu tarea es:
1. Categorizar el negocio en UNA de estas categorías:
   - Salud
   - Educación
   - Entretenimiento
   - Viajes
   - Restaurantes
   - Supermercados
   - Transporte
   - Servicios
   - Compras
   - Hogar
   - Otros

IMPORTANTE:
- Usa tu conocimiento del país específico para identificar negocios locales. De no estar seguro, realiza una búsqueda en la web para confirmar.
- Si el nombre del negocio que recibes está en un formato tipo abreviatura, determina el nombre del negocio real para categorizarlo correctamente. De no poder identificar el negocio real, realiza una búsqueda exhaustiva en la web para encontrar el nombre real del negocio y así puedas categorizarlo correctamente.
- Si no puedes identificar el negocio real, asígnale la categoría "Otros".
- Retorna solo la categoría, sin explicaciones ni comentarios adicionales.`,
        input: `País: ${country}\nNombre del local: ${localName}`,
        tools: [
          { type: "web_search" },
        ],
        reasoning: { effort: 'high' },
        temperature: 0.2,
      });

      const result = response.output_text;
      
      if (!result) {
        return 'Indeterminado';
      }

      return result;
    } catch (error) {
      console.error('Error categorizing local:', error);
      return 'Indeterminado';
    }
  }
}
