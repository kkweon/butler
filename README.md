# Butler

Butler is a Chrome extension that provides a unified search interface for managing browser tabs, browsing history, and executing browser actions. Built with Angular 20 and Material Design, it helps power users efficiently navigate and organize their browsing sessions.

<div>
  <img src="./readme_assets/butler_demo.gif" width="100%" align="center">
</div>

## Features

- **Tab Search**: Find and switch to open tabs using fuzzy search
- **History Search**: Search browser history with configurable date ranges
- **Browser Actions**: Execute common tab management operations
  - Close other tabs (excluding pinned tabs)
  - Close tabs to the right
  - Open extension settings
- **Configurable Options**: Customize search data sources (tabs, history, bookmarks)
- **Fuzzy Search**: Powered by Fuse.js for intelligent matching
- **Material Design**: Clean, responsive interface

## Installation

### From Chrome Web Store

Install Butler directly from the [Chrome Web Store](https://chrome.google.com/webstore/detail/haepoecmeobjjfeonmpphmpajaefcnfo).

### Local Development

1. Clone the repository: `git clone https://github.com/kkweon/butler.git`
2. Install dependencies: `yarn install`
3. Build the extension: `yarn build:prod`
4. Load the `dist/butler` folder as an unpacked extension in Chrome

## Usage

1. Click the Butler extension icon in your browser toolbar
2. Type to search across tabs, history, and browser actions
3. Use arrow keys to navigate results and Enter to select
4. Access settings through the "Open settings" action or right-click the extension icon

## Development

This project uses Angular 20 with a multi-project workspace structure.

### Prerequisites

- Node.js 22+
- Yarn package manager

### Project Structure

```
butler/
├── src/                          # Main extension (butler project)
├── projects/
│   ├── options/                  # Extension options/settings page
│   └── chrome-shared-options/    # Shared Chrome storage utilities
```

### Development Commands

```bash
# Install dependencies
yarn install

# Start development server (for testing components)
yarn start

# Build all projects
yarn build

# Build for production
yarn build:prod

# Run tests
yarn test

# Format code
yarn format

# Create distributable zip
yarn zip
```

### Architecture

- **Main Extension** (`src/`): Angular application with search interface and Chrome API integration
- **Options Page** (`projects/options/`): Settings interface for configuring search preferences
- **Shared Library** (`projects/chrome-shared-options/`): Common utilities for Chrome storage management
- **Build System**: Multi-project Angular workspace with custom build pipeline
- **CI/CD**: Automated testing and Chrome Web Store publishing via semantic-release

### Chrome Permissions

Butler requires the following permissions:

- `tabs`: Access and manage browser tabs
- `history`: Search browsing history
- `storage`: Save user preferences

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run tests: `yarn test`
5. Format code: `yarn format`
6. Commit your changes: `git commit -m 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Submit a pull request

### Development Notes

- The extension uses Chrome Extension Manifest V2
- Fuzzy search is implemented using Fuse.js
- UI components use Angular Material
- State management uses RxJS observables
- Chrome APIs are wrapped in Promise-based service layer

## License

This project is licensed under the MIT License.
