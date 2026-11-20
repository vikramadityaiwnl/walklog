# Repository instructions

## Git workflow

- Use short, lowercase, hyphenated feature branch names. Follow existing names such as `setup` and `firebase-ai`.
- Use Conventional Commits with concise, imperative subjects. An optional scope goes in parentheses after the type, as in `feat(ai): add Firebase hybrid AI generation`. An unscoped subject such as `fix: pin Firebase BoM for Expo Kotlin compatibility` is also valid. Make focused commits that can be reviewed independently. Preserve unrelated working-tree and staged changes.
- When asked to create a pull request, include the complete set of changes made for the branch. Review the full diff and commit history against the target branch so the PR title, summary, and verification cover the full scope. Target `main` by default and use the target branch the user names when they specify one.
- After required checks and reviews pass, merge the PR into its target unless the user asks to leave it open or requests a draft. Follow branch protection and report any check or approval that prevents the merge.

## Code style

- Use kebab-case for all filenames, including component files. Use PascalCase for React component names, with the first letter of each word capitalized. For example, define `SignInForm` in `sign-in-form.tsx`.
- Declare a typed `interface Props` above each component that receives props. Define the component as a named function with a single `props: Props` parameter. Access fields as `props.field` throughout the component body.
- Group state for the same operation into one minimal state value. Represent mutually exclusive states with a status or discriminated union, and store details on the variant that needs them. For example, sign-in can be `idle`, `loading`, or `error`, with an error message on the `error` variant. Keep independent state separate and derive values such as `isSigningIn` from the status.
- Keep imports together as one block; do not add blank lines to separate import groups.
- Keep related statements, state, variables, and logic together. Use one blank line to separate distinct concerns or logical groups, such as state from derived values or one operation's setup from another. Do not add a blank line between every variable or statement.
- For app changes, use `app/.prettierrc.json`. After completing the work, run `npm run format -- <changed files>` from `app/` on changed supported code and documents. Use `npm run format:check -- <changed files>` to check without changing files. Preserve intentional blank lines between logical groups.
- Do not format generated native files, dependency patches, lockfiles, or local environment files; they are excluded by `app/.prettierignore`. Avoid reformatting unrelated files.

```tsx
import { Text } from "react-native";

interface Props {
  x: string;
  y: string;
}

function Component(props: Props) {
  return <Text>{`${props.x} ${props.y}`}</Text>;
}
```
