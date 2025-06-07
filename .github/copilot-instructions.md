# GitHub Copilot Instructions for the Butler Project

This document provides guidelines for GitHub Copilot to ensure its suggestions align with the project's standards and practices.

## 1. Coding Conventions

Adhere to the following coding conventions:

- **Indentation**: Use 2 spaces for indentation. Do not use tabs.
- **Quotes**: Use single quotes (`'`) for all TypeScript, HTML, and SCSS code.
- **Semicolons**: Do not use semicolons at the end of statements in TypeScript.
- **Trailing Commas**: Use trailing commas for multi-line object literals, array literals, and function parameter lists (Prettier's `all` option).
- **Max Line Length**: Keep lines of TypeScript code within 140 characters.
- **Naming Conventions**:
  - **Components**:
    - Selectors: Use kebab-case with an `app-` prefix (e.g., `<app-user-profile>`).
    - Class names: PascalCase with `Component` suffix (e.g., `UserProfileComponent`).
    - File names: `component-name.component.ts`.
  - **Directives**:
    - Selectors: Use camelCase with an `app` prefix, enclosed in square brackets for attribute selectors (e.g., `[appHighlightText]`).
    - Class names: PascalCase with `Directive` suffix (e.g., `HighlightTextDirective`).
    - File names: `directive-name.directive.ts`.
  - **Services**:
    - Class names: PascalCase with `Service` suffix (e.g., `UserDataService`).
    - File names: `service-name.service.ts`.
  - **Modules**:
    - Class names: PascalCase with `Module` suffix (e.g., `SharedComponentsModule`).
    - File names: `module-name.module.ts`.
  - **Interfaces**: Use PascalCase (e.g., `User`). While some conventions use an `I` prefix (e.g., `IUser`), refer to the project's ESLint configuration (`.eslintrc.json`) for the definitive naming rules. If ESLint flags a generated name, prioritize the ESLint rule.
  - **Variables and Functions**: Use camelCase (e.g., `currentUser`, `getUserData`).
  - **SCSS**: Use kebab-case for class names and variables (e.g., `.user-profile`, `$primary-color`).
- **Styling**:
  - Use SCSS for all styles.
  - Component styles should be encapsulated and placed in `.scss` files alongside the component.
- **Formatting**:
  - Code formatting is handled by Prettier. Ensure generated code is compatible with Prettier rules (see `.prettierrc.yml`). A pre-commit hook runs `pretty-quick` to format staged files.

## 2. Frameworks, Libraries, and Tools

### Core Technology Stack

- **Node.js (v22+)**: JavaScript runtime environment for development and build processes.
- **TypeScript (v5.8)**: Primary programming language for the project, providing static typing and modern JavaScript features.
- **Yarn**: Package manager used for dependency management and script execution. Use `yarn install` for dependencies and `yarn <script>` for running project scripts.

### Main Framework

- **Angular (v20)**: This is the core framework.

  - Generate components, services, modules, pipes, and directives using Angular CLI conventions where possible.
  - Example of a simple component:

    ```typescript
    import { Component } from '@angular/core'

    @Component({
      selector: 'app-example',
      templateUrl: './example.component.html',
      styleUrls: ['./example.component.scss'],
    })
    export class ExampleComponent {
      message: string = 'Hello from Copilot!'

      constructor() {}
    }
    ```

- **Angular Material (v20)**: Used for UI components.
  - When suggesting UI elements, prefer Angular Material components.
  - Import specific modules from `@angular/material` (e.g., `MatButtonModule`, `MatInputModule`).
  - Example:
    ```html
    <button mat-raised-button color="primary">Click Me</button>
    ```
- **RxJS (v7.8)**: Used extensively for asynchronous operations and state management.

  - Use RxJS operators for data manipulation and event handling.
  - Ensure proper subscription management to avoid memory leaks (e.g., using `takeUntil` or `async` pipe).
  - Example:

    ```typescript
    import { Observable, Subject } from 'rxjs';
    import { takeUntil, map } from 'rxjs/operators';

    // In a component
    private unsubscribe$: Subject<void> = new Subject<void>();
    data$: Observable<string>;

    ngOnInit() {
      this.dataService.getData().pipe(
        map(item => item.name),
        takeUntil(this.unsubscribe$)
      ).subscribe(name => {
        console.log(name);
      });
    }

    ngOnDestroy() {
      this.unsubscribe$.next();
      this.unsubscribe$.complete();
    }
    ```

### Additional Libraries

- **Fuse.js (v6.5)**: Fuzzy search library used for intelligent search functionality across tabs, history, and browser actions.
  - Used to implement the core search features of the Butler extension.
  - Example usage for searching through browser tabs or history items.

### Chrome Extension Platform

- **Chrome Extension Manifest V3**: Target platform for the Butler extension.
  - The extension provides unified search interface for browser tabs, history, and actions.
  - Single Angular project structure located in `src/`, containing the main extension popup, options page, and shared services.
  - The extension provides a unified search interface for browser tabs, history, and actions.
  - Key Chrome APIs used: `chrome.tabs`, `chrome.history`, `chrome.storage`, `chrome.windows`.

### Development Tools

- **Husky**: Git hooks for code quality enforcement.
  - Pre-commit hook runs `pretty-quick` to format staged files automatically.
- **semantic-release**: Automated release management and Chrome Web Store publishing.
- **ESLint**: Refer to `.eslintrc.json` for specific linting rules.

## 3. Testing Guidelines

- **Framework**: Jasmine is used with the Karma test runner.
- **File Naming**: Test files should end with `.spec.ts` (e.g., `example.component.spec.ts`).
- **Location**: Unit tests are co-located with their source files.
- **Structure**:

  - Use `describe` to group related tests.
  - Use `it` for individual test cases.
  - Use `expect` for assertions.
  - Utilize `beforeEach` for setup common to multiple tests within a `describe` block.
  - Example of a component test:

    ```typescript
    import { ComponentFixture, TestBed } from '@angular/core/testing'
    import { ExampleComponent } from './example.component'

    describe('ExampleComponent', () => {
      let component: ExampleComponent
      let fixture: ComponentFixture<ExampleComponent>

      beforeEach(async () => {
        await TestBed.configureTestingModule({
          declarations: [ExampleComponent],
        }).compileComponents()
      })

      beforeEach(() => {
        fixture = TestBed.createComponent(ExampleComponent)
        component = fixture.componentInstance
        fixture.detectChanges()
      })

      it('should create', () => {
        expect(component).toBeTruthy()
      })

      it('should have a message', () => {
        expect(component.message).toBe('Hello from Copilot!')
      })
    })
    ```

- **Running Tests**: Use the `ng test` command. Ensure new features and bug fixes are covered by tests.

## 4. Commit Message Format

This project uses **Conventional Commits**. Ensure your commit messages adhere to this format:

```
type(scope): subject

body (optional)

footer (optional)
```

- **Type**: Must be one of the following:
  - `feat`: A new feature.
  - `fix`: A bug fix.
  - `build`: Changes that affect the build system or external dependencies (e.g., gulp, broccoli, npm).
  - `chore`: Other changes that don't modify `src` or `test` files (e.g., updating build tasks, package manager configs).
  - `ci`: Changes to CI configuration files and scripts.
  - `docs`: Documentation only changes.
  - `perf`: A code change that improves performance.
  - `refactor`: A code change that neither fixes a bug nor adds a feature.
  - `revert`: Reverts a previous commit.
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
  - `test`: Adding missing tests or correcting existing tests.
- **Scope (Optional)**: The scope should be a logical part of the application affected (e.g., `app`, `options`, `ui`, `search`, `core`).
- **Subject**: A concise description of the change.
  - Use the imperative, present tense: "change" not "changed" nor "changes".
  - Don't capitalize the first letter.
  - No dot (`.`) at the end.
- **Body (Optional)**: A more detailed explanatory text, if needed.
- **Footer (Optional)**: For breaking changes (use `BREAKING CHANGE:`) or referencing issues.

Example:

```
feat(options): add dark mode toggle

Users can now switch between light and dark themes in the options page.
This closes #123.
```

## 5. Additional Project-Specific Practices

- **Modularity**: Strive for modular and reusable code, for example by organizing shared functionality into services.
- **Build System**: Be aware of the project structure (`butler`, `options`, `chrome-shared-options`) and how they are built (see `angular.json` and `package.json` scripts). Changes should not break the build.
- **Error Handling**: Implement robust error handling, especially for API calls or Chrome extension API interactions.
- **Chrome Extension APIs**: When interacting with Chrome extension APIs (e.g., `chrome.storage`, `chrome.tabs`), ensure correct usage and handle callbacks or Promises appropriately.

By following these guidelines, GitHub Copilot can provide more relevant and useful suggestions for this project.
