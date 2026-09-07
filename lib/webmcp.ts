export type ModelTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerTrayTool(
  stage: (items: { id: string; quantity: number }[]) => void,
) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: ModelTool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'stage_canteen_tray',
          title: 'Stage a canteen tray',
          description:
            'Replace the visible tray with selected menu items and open the menu. Does not place an order or deduct coins; review and checkout in the page.',
          inputSchema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                minItems: 1,
                maxItems: 20,
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1, maximum: 10 },
                  },
                  required: ['id', 'quantity'],
                  additionalProperties: false,
                },
              },
            },
            required: ['items'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (
              !input ||
              typeof input !== 'object' ||
              !('items' in input) ||
              !Array.isArray(input.items) ||
              input.items.length < 1 ||
              input.items.length > 20
            )
              throw new Error('Provide 1–20 menu items.');
            const ids = new Set();
            for (const item of input.items) {
              if (
                !item ||
                typeof item.id !== 'string' ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 10 ||
                ids.has(item.id)
              )
                throw new Error(
                  'Provide unique menu items and quantities from 1 to 10.',
                );
              ids.add(item.id);
            }
            stage(input.items);
            return { staged: true, ordered: false };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {
    /* Optional browser capability; visible checkout remains available. */
  }
  return () => lifecycle.abort();
}
