# Naming & Style Conventions

## Files & Directories

- **File names**: `kebab-case.ts` (e.g. `send-sms.ts`, `payment-gateway.ts`)
- **Test files**: `<name>.test.ts` colocated next to the module they test
- **Feature folders**: `src/features/<feature-name>/`

## TypeScript

- **Types & Interfaces**: `PascalCase` (e.g. `PaymentResult`, `SmsProvider`)
- **Constants & enums**: `UPPER_SNAKE_CASE` for true constants, `PascalCase` for enums
- **Functions & variables**: `camelCase`

## Money & Currency

- All monetary values use `*Rial` suffix (e.g. `amountRial`, `balanceRial`)
- Store as integer (minor unit) — never floating-point

## PII & Sensitive Data

- Phone numbers, national IDs, card numbers: mask in logs
- Use `*Enc` suffix for encrypted fields (e.g. `phoneEnc`)
- Use `*Hash` suffix for hashed fields (e.g. `nationalIdHash`)
- Use `*Last4` suffix for masked tail (e.g. `cardLast4`)

## Path Aliases

- `@/*` resolves to `src/*` (configured in `tsconfig.json` and `vitest.config.ts`)

## Package Manager

- Use `pnpm` exclusively
