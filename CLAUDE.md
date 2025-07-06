# Critical rules

- use yarn
- After every task run `yarn verify` and ONLY CONSIDER IT DONE IF ALL 100% PASS!
- when debugging try: adding logging on the related flow, running `git diff`.
- To explore folder structure: `tree -I 'node_modules|.git|dist|build' -L 3 --dirsfirst`
- Always prefix interfaces with `I`
- Follow existing project structure and naming conventions
- Run tests / lint / type checks proactively, after changes.
- To validate endpoints, use `curl`
- When throwing errors, favor usage of src/exceptions/http-exceptions.ts
- Use context7 to fetch docs about libs, if needed.
- Avoid using index.ts to reexport things all the time. Its redundant.
- If needed to kill a port, use `npx kill-port PORTNUMBERHERE`
- Favor constructor injection like `constructor(private myService: MyService) {}` instead of Container.get
- When creating controllers make sure to hook them on app.ts
- use LoggerService for debbuging if needed
- Never use process.env directly. Hook variable on env.ts
- Promote DRY, SRP, KISS as main principles
- Use mermaid for diagrams in documentation - do not use () inside of it
