import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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
      const messages: any[] = [
        {
          role: 'system',
          content: `Eres un asistente experto en extraer información de gastos de correos electrónicos de bancos peruanos (BBVA, BCP, Interbank, Scotiabank).
          
Tu tarea es extraer la siguiente información del HTML del correo:
- local: El nombre del establecimiento o comercio donde se realizó la compra
- amount: El monto cargado (solo el número, sin símbolos de moneda)
- bank: El nombre del banco
- paymentMethod: El método de pago (tarjeta de crédito, débito, etc.) si está disponible
- date: La fecha de la transacción en formato ISO (YYYY-MM-DD) si está disponible

IMPORTANTE:
- Si el correo NO es sobre una transacción o gasto, devuelve null
- Extrae solo información de transacciones confirmadas, no de autorizaciones pendientes
- El amount debe ser un número positivo
- Si hay múltiples transacciones en el correo, extrae solo la primera

Responde ÚNICAMENTE con un objeto JSON válido o null. No incluyas explicaciones adicionales.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Asunto: ${subject}\n\nContenido HTML:\n${htmlContent.substring(0, 8000)}`,
            },
          ],
        },
      ];

      // Add images if available
      if (images && images.length > 0) {
        for (const image of images) {
          messages[1].content.push({
            type: 'image_url',
            image_url: { url: image },
          });
        }
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const result = JSON.parse(content);
      
      if (!result || !result.local || !result.amount) {
        return null;
      }

      return result;
    } catch (error) {
      console.error('Error extracting expense from email:', error);
      return null;
    }
  }

  async categorizeLocal(
    localName: string,
    country: string,
  ): Promise<CategorizedLocal> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente experto en identificar negocios y categorizarlos.

Tu tarea es:
1. Identificar el nombre REAL del negocio a partir de la abreviatura o nombre que aparece en el comprobante bancario
2. Categorizarlo en UNA de estas categorías:
   - Salud
   - Educación
   - Entretenimiento
   - Viajes
   - Comida & Restaurantes
   - Transporte
   - Servicios
   - Compras
   - Hogar
   - Otros

IMPORTANTE:
- Usa tu conocimiento del país específico para identificar negocios locales
- Si no puedes identificar el negocio real, usa el nombre proporcionado
- Sé específico con el nombre real del negocio (ej: "WONG" → "Wong Supermercados")

Responde ÚNICAMENTE con un objeto JSON con esta estructura:
{
  "actualLocal": "Nombre real del negocio",
  "category": "Categoría"
}`,
          },
          {
            role: 'user',
            content: `País: ${country}\nNombre del local: ${localName}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          actualLocal: localName,
          category: 'Otros',
        };
      }

      const result = JSON.parse(content);
      return result;
    } catch (error) {
      console.error('Error categorizing local:', error);
      return {
        actualLocal: localName,
        category: 'Otros',
      };
    }
  }
}
