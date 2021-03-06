import * as path from 'path';
import compareVersions from 'compare-versions';
import {
	existsSync,
	readFileSync
} from 'fs';

export function getDefaultOptions () {
	return {
		noEmitHelpers: true,
		module: 'es2015',
		sourceMap: true
	};
}

// Gratefully lifted from 'look-up', due to problems using it directly:
//   https://github.com/jonschlinkert/look-up/blob/master/index.js
//   MIT Licenced
function findFile ( cwd, filename ) {
	let fp = cwd ? ( cwd + '/' + filename ) : filename;

	if ( existsSync( fp ) ) {
		return fp;
	}

	const segs = cwd.split( path.sep );
	let len = segs.length;

	while ( len-- ) {
		cwd = segs.slice( 0, len ).join( '/' );
		fp = cwd + '/' + filename;
		if ( existsSync( fp ) ) {
			return fp;
		}
	}

	return null;
}

export function compilerOptionsFromTsConfig ( typescript ) {
	const cwd = process.cwd();

	const tsconfig = typescript.readConfigFile( findFile( cwd, 'tsconfig.json' ), path => readFileSync( path, 'utf8' ) );

	if ( !tsconfig.config || !tsconfig.config.compilerOptions ) return {};

	if (tsconfig.config.extends) {
		return mergeInheritedCompilerOptions(tsconfig.config);
	}

	return tsconfig.config.compilerOptions;
}

export function adjustCompilerOptions ( typescript, options ) {
	// Set `sourceMap` to `inlineSourceMap` if it's a boolean
	// under the assumption that both are never specified simultaneously.
	if ( typeof options.inlineSourceMap === 'boolean' ) {
		options.sourceMap = options.inlineSourceMap;
		delete options.inlineSourceMap;
	}

	// Delete the `declaration` option to prevent compilation error.
	// See: https://github.com/rollup/rollup-plugin-typescript/issues/45
	delete options.declaration;

	const tsVersion = typescript.version.split('-')[0];
	if ( 'strictNullChecks' in options && compareVersions( tsVersion, '1.9.0' ) < 0 ) {
		delete options.strictNullChecks;

		console.warn( `rollup-plugin-typescript: 'strictNullChecks' is not supported; disabling it` );
	}
}

/**
 * Typescript 2.1 introduced configuration inheritance.
 * See: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html
 * This function merges all inherited compilerOptions.
 */
function mergeInheritedCompilerOptions (config) {
	const compilerOptions = [config.compilerOptions];
	let currentDir = path.resolve(".");

	while (config.extends) {
		const parentFile = path.join(currentDir, config.extends);
		const parentDir = path.dirname(parentFile);
		const parentConfig = require(parentFile);

		if (parentConfig.compilerOptions) {
			compilerOptions.push(parentConfig.compilerOptions);
		}

		config = parentConfig;
		currentDir = parentDir;
	}

	const baseOption = compilerOptions.pop();
	compilerOptions.reverse();
	Object.assign(baseOption, ...compilerOptions);

	return baseOption;
}
