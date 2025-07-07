**Concise Critical Rules**

- System now is fully dockerized. Use docker commands to debug and manage
- Use **Yarn**.
- After every change run `yarn verify`; only proceed when **100 % green**.
- Debug with extra logs + `git diff`.
- Inspect folders:

  ```bash
  tree -I 'node_modules|.git|dist|build' -L 3 --dirsfirst
  ```

- Prefix _all_ interfaces with **I**; follow existing structure/names.
- Run tests / lint / type-checks proactively.
- Check endpoints via `curl`.
- Throw errors via `src/exceptions/http-exceptions.ts`.
- Grab library docs with **context7** if needed.
- Skip redundant `index.ts` re-exports.
- Free a port: `npx kill-port <PORT>`.
- Prefer constructor DI: `constructor(private svc: MyService) {}` (avoid `Container.get`).
- Register new controllers in **app.ts**.
- Use **LoggerService** for debugging.
- Access env vars only through **env.ts** (no direct `process.env`).
- Embrace **DRY / SRP / KISS**.
- Docs: draw diagrams in **Mermaid** (no parentheses).
- Use the **HttpStatus** enum instead of hard-coding codes.
