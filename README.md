# DropCode

A command-line tool for downloading files from DropCode snippets.

This CLI tool is designed for the [DropCode](https://dropcode.tonary.app) project, a service for sharing code snippets and files.

## Installation

Install dropcode globally using your preferred package manager:

### npm
```bash
npm install -g dropcode
```

### yarn
```bash
yarn global add dropcode
```

### pnpm
```bash
pnpm add -g dropcode
```

## Usage

### After Installation

Once installed globally, you can use the `dropcode` command from anywhere:

```bash
# Using a full URL
dropcode https://dropcode.tonary.app/W_ookvg12pvtwjF36W6iqSi1gVz0cY7u

# Using just the snippet ID
dropcode W_ookvg12pvtwjF36W6iqSi1gVz0cY7u
```

The file will be downloaded to your current directory.

### Without Installation (npx)

You can also use dropcode without installing it globally:

```bash
# Using a full URL
npx dropcode https://dropcode.tonary.app/W_ookvg12pvtwjF36W6iqSi1gVz0cY7u

# Using just the snippet ID
npx dropcode W_ookvg12pvtwjF36W6iqSi1gVz0cY7u
```

## How It Works

1. Provide a dropcode URL or snippet ID
2. The tool fetches the file information
3. The file is automatically downloaded to your current directory

If you encounter any access issues, the tool will automatically open the snippet page in your browser as a fallback.

## License

MIT
