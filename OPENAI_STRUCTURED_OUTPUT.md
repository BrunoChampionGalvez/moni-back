# OpenAI Structured Output Implementation

## Overview

The backend now uses OpenAI's **Responses API with Structured Outputs** via `responses.parse()` and Zod schemas. This ensures the AI model returns data in exactly the format we need.

## What Changed

### Before (JSON mode with manual parsing):
```typescript
const response = await this.openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  response_format: { type: 'json_object' },
});
const result = JSON.parse(response.choices[0].message.content);
```

**Problems:**
- No guarantee of schema compliance
- Manual JSON parsing required
- Potential runtime errors if JSON is malformed
- No TypeScript type safety

### After (Structured outputs with Zod):
```typescript
const ExpenseSchema = z.object({
  local: z.string(),
  amount: z.string(),
  bank: z.string(),
  paymentMethod: z.string().optional(),
  date: z.string().optional(),
});

const response = await this.openai.responses.parse({
  model: 'gpt-4o-2024-08-06',
  input: [...],
  text: {
    format: zodTextFormat(ExpenseSchema as any, 'expense_info'),
  },
});

const result = response.output_parsed; // Already typed and validated!
```

**Benefits:**
✅ **Guaranteed schema compliance** - OpenAI ensures output matches schema
✅ **No manual parsing** - Returns pre-parsed object
✅ **Type safety** - Full TypeScript support
✅ **Validation** - Zod validates the structure
✅ **Better reliability** - Fewer runtime errors

## Implementation Details

### 1. Extract Expense From Email (`extractExpenseFromEmail`)

**Purpose:** Extracts transaction data from bank email HTML.

**Schema:**
```typescript
const ExpenseSchema = z.object({
  local: z.string(),           // Store/business name
  amount: z.string(),          // Amount charged
  bank: z.string(),            // Bank name
  paymentMethod: z.string().optional(), // Credit/debit card
  date: z.string().optional(), // Transaction date (ISO format)
});
```

**Model:** `gpt-4o-2024-08-06` (required for structured outputs)

**Input format:**
- System message: Expert instructions for extracting Peruvian bank email data
- User message: Email subject + HTML content

**Output:** `ExtractedExpenseData` object or `null` if not a transaction email

### 2. Categorize Local (`categorizeLocal`)

**Purpose:** Identifies the real business name and categorizes it.

**Schema:**
```typescript
const CategorySchema = z.object({
  actualLocal: z.string(), // Real business name
  category: z.string(),    // Category (Salud, Educación, etc.)
});
```

**Model:** `gpt-4o-2024-08-06`

**Input format:**
- System message: Instructions for identifying and categorizing businesses
- User message: Country + local name from bank transaction

**Categories:**
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

**Output:** `CategorizedLocal` object with validated fields

## Type Safety Workaround

Due to a minor version mismatch between Zod and OpenAI SDK types, we use `as any` type assertion:

```typescript
format: zodTextFormat(ExpenseSchema as any, 'expense_info')
```

This is safe because:
1. Zod schema is valid at runtime
2. OpenAI SDK properly validates the schema
3. Only the TypeScript compiler needs the assertion
4. Functionality is unaffected

## API Reference

### OpenAI Responses API with Parse

```typescript
const response = await openai.responses.parse({
  model: 'gpt-4o-2024-08-06', // Required model for structured outputs
  input: [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'User input' },
  ],
  text: {
    format: zodTextFormat(Schema, 'name'),
  },
  temperature: 0.1, // Lower = more deterministic
});

// Access parsed result directly
const data = response.output_parsed;
```

## Dependencies

- **openai**: ^6.1.0 (has Responses API support)
- **zod**: ^4.1.12 (schema validation)
- **openai/helpers/zod**: Provides `zodTextFormat` helper

## Error Handling

Both methods include try-catch blocks with fallbacks:

- `extractExpenseFromEmail`: Returns `null` on error
- `categorizeLocal`: Returns default category "Otros" with original local name

This ensures the app continues working even if OpenAI API fails.

## Next Steps

1. ✅ **Test with real bank emails** - Verify extraction accuracy
2. ⏳ **Monitor API costs** - Structured outputs may have different pricing
3. ⏳ **Add image support** - Currently only processes HTML text
4. ⏳ **Fine-tune prompts** - Improve extraction accuracy based on testing

## Resources

- [OpenAI Structured Outputs Docs](https://platform.openai.com/docs/guides/structured-outputs)
- [Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [Zod Documentation](https://zod.dev/)
