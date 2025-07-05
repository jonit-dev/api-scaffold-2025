# Critical rules

- use yarn
- when debugging try: adding logging on the related flow, running `git diff`.
- To explore folder structure: `tree -I 'node_modules|.git|dist|build' -L 3 --dirsfirst`
- Always prefix interfaces with `I`
- Follow existing project structure and naming conventions
- Run tests / lint / type checks proactively, after changes.
- To validate endpoints, use `curl`
- When throwing errors, favor usage of src/exceptions/http-exceptions.ts
- Docker containers debugging, please use docker mcp
- Use context7 to fetch docs about libs, if needed.
