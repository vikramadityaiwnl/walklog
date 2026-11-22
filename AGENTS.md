# Repository instructions

## Brand

- Write the product name as `walklog`: one word, entirely lowercase.
- Use Manrope for titles and DM Sans for body text in the app. Prefer the shared `AppText` component for app text.

## Git workflow

- Use short, lowercase, hyphenated feature branch names. Follow existing names such as `setup` and `firebase-ai`.
- Use Conventional Commits with concise, imperative subjects. An optional scope goes in parentheses after the type, as in `feat(ai): add Firebase hybrid AI generation`. An unscoped subject such as `fix: pin Firebase BoM for Expo Kotlin compatibility` is also valid. Make focused commits that can be reviewed independently. Preserve unrelated working-tree and staged changes.
- When asked to create a pull request, include the complete set of changes made for the branch. Review the full diff and commit history against the target branch so the PR title, summary, and verification cover the full scope. Target `main` by default and use the target branch the user names when they specify one.
- Write pull request titles as concise, descriptive summaries of the change. Do not use Conventional Commit prefixes or copy a commit subject as the PR title.
- After required checks and reviews pass, merge the PR into its target unless the user asks to leave it open or requests a draft. Follow branch protection and report any check or approval that prevents the merge.

## Interface design

- Keep interfaces minimal and contextual: show only the information and actions needed for the current state, and reveal additional controls as they become relevant.

- Group related titles and descriptions closely, and separate them from subsequent fields or sections. Use clear text and spacing hierarchy to communicate which elements belong together.
- Keep Back buttons out of nested screens; use the platform’s back navigation. Place bottom actions in one row, with equal widths when there are two.

## Code style

- Keep screen-specific styles in the screen that uses them. Match shared visual patterns through theme tokens and existing components rather than a cross-screen style sheet.

- Use kebab-case for all filenames, including component files. Use PascalCase for React component names, with the first letter of each word capitalized. For example, define `SignInForm` in `sign-in-form.tsx`.
- Declare a typed `interface Props` above each component that receives props. Define the component as a named function with a single `props: Props` parameter. Access fields as `props.field` throughout the component body.
- Group state for the same operation into one minimal state value. Represent mutually exclusive states with a status or discriminated union, and store details on the variant that needs them. For example, sign-in can be `idle`, `loading`, or `error`, with an error message on the `error` variant. Keep independent state separate and derive values such as `isSigningIn` from the status.
- When selecting multiple Zustand values, destructure an explicit selector wrapped in `useShallow`, such as `const { x, y } = useStore(useShallow((state) => ({ x: state.x, y: state.y })))`. For one value, use an individual selector. Avoid subscribing to the whole store solely to destructure a subset.
- Keep imports together as one block; do not add blank lines to separate import groups.
- Leave a blank line between each interface or type declaration.
- Separate sibling JSX components and expressions with a blank line. Keep the first child next to its opening parent and the last child next to its closing parent; keep inline text and expressions together.
- Leave a blank line before a return statement when it follows other statements in the same block, and after an early-return guard before the next statement. Keep single-statement blocks compact.
- Keep related statements, state, variables, and logic together. Use one blank line to separate distinct concerns or logical groups, such as state from derived values or one operation's setup from another. Do not add a blank line between every variable or statement.
- Separate route parameter extraction, Zustand selections, form state, and other distinct concerns with a blank line.
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
