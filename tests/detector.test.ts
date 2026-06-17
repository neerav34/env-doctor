import { describe, it, expect } from 'vitest';
import { detectVarsInContent } from '../src/core/detector.js';

describe('detectVarsInContent', () => {
  describe('JavaScript / TypeScript', () => {
    it('detects process.env.VAR_NAME', () => {
      const refs = detectVarsInContent('const x = process.env.DATABASE_URL;', 'app.ts');
      expect(refs).toHaveLength(1);
      expect(refs[0]?.name).toBe('DATABASE_URL');
      expect(refs[0]?.line).toBe(1);
    });

    it('detects process.env["VAR_NAME"]', () => {
      const refs = detectVarsInContent('const x = process.env["API_KEY"];', 'app.js');
      expect(refs[0]?.name).toBe('API_KEY');
    });

    it("detects process.env['VAR_NAME']", () => {
      const refs = detectVarsInContent("const x = process.env['JWT_SECRET'];", 'app.js');
      expect(refs[0]?.name).toBe('JWT_SECRET');
    });

    it('detects import.meta.env.VAR_NAME', () => {
      const refs = detectVarsInContent('const url = import.meta.env.VITE_API_URL;', 'app.ts');
      expect(refs[0]?.name).toBe('VITE_API_URL');
    });

    it('detects multiple vars in the same file', () => {
      const code = [
        'const db = process.env.DATABASE_URL;',
        'const port = process.env.PORT;',
        'const key = process.env.API_KEY;',
      ].join('\n');
      const refs = detectVarsInContent(code, 'app.ts');
      const names = refs.map(r => r.name).sort();
      expect(names).toEqual(['API_KEY', 'DATABASE_URL', 'PORT']);
    });

    it('ignores commented-out lines (//)', () => {
      const refs = detectVarsInContent('// const x = process.env.OLD_VAR;', 'app.ts');
      expect(refs).toHaveLength(0);
    });

    it('ignores commented-out lines (#)', () => {
      const refs = detectVarsInContent('# const x = process.env.OLD_VAR;', 'app.ts');
      expect(refs).toHaveLength(0);
    });

    it('records correct line numbers', () => {
      const code = 'const a = 1;\nconst b = process.env.MY_VAR;\n';
      const refs = detectVarsInContent(code, 'app.ts');
      expect(refs[0]?.line).toBe(2);
    });

    it('records correct column numbers', () => {
      const code = 'const x = process.env.MY_VAR;';
      const refs = detectVarsInContent(code, 'app.ts');
      expect(refs[0]?.column).toBe(11); // 'const x = ' is 10 chars
    });

    it('deduplicates identical references on same line', () => {
      const code = 'const x = process.env.MY_VAR || process.env.MY_VAR;';
      const refs = detectVarsInContent(code, 'app.ts');
      expect(refs).toHaveLength(2); // Same name, different columns
    });
  });

  describe('Python', () => {
    it("detects os.environ['VAR']", () => {
      const refs = detectVarsInContent("x = os.environ['SECRET_KEY']", 'app.py');
      expect(refs[0]?.name).toBe('SECRET_KEY');
    });

    it("detects os.environ.get('VAR')", () => {
      const refs = detectVarsInContent("x = os.environ.get('DEBUG')", 'app.py');
      expect(refs[0]?.name).toBe('DEBUG');
    });

    it("detects os.getenv('VAR')", () => {
      const refs = detectVarsInContent("x = os.getenv('PORT')", 'app.py');
      expect(refs[0]?.name).toBe('PORT');
    });

    it('only matches in .py files', () => {
      // Python patterns should not fire in .ts files
      const refs = detectVarsInContent("x = os.getenv('PORT')", 'app.ts');
      expect(refs).toHaveLength(0);
    });
  });

  describe('Go', () => {
    it('detects os.Getenv("VAR")', () => {
      const refs = detectVarsInContent('x := os.Getenv("DB_HOST")', 'main.go');
      expect(refs[0]?.name).toBe('DB_HOST');
    });

    it('only matches in .go files', () => {
      const refs = detectVarsInContent('x := os.Getenv("DB_HOST")', 'app.ts');
      expect(refs).toHaveLength(0);
    });
  });

  describe('Rust', () => {
    it('detects env::var("VAR")', () => {
      const refs = detectVarsInContent('let x = env::var("DATABASE_URL").unwrap();', 'main.rs');
      expect(refs[0]?.name).toBe('DATABASE_URL');
    });
  });

  describe('Ruby', () => {
    it("detects ENV['VAR']", () => {
      const refs = detectVarsInContent("key = ENV['RAILS_ENV']", 'app.rb');
      expect(refs[0]?.name).toBe('RAILS_ENV');
    });
  });

  describe('PHP', () => {
    it('detects $_ENV["VAR"]', () => {
      const refs = detectVarsInContent('$key = $_ENV["APP_KEY"];', 'app.php');
      expect(refs[0]?.name).toBe('APP_KEY');
    });

    it('detects getenv("VAR")', () => {
      const refs = detectVarsInContent('$url = getenv("DATABASE_URL");', 'app.php');
      expect(refs[0]?.name).toBe('DATABASE_URL');
    });
  });

  describe('Shell / Docker', () => {
    it('detects ${VAR} in shell files', () => {
      const refs = detectVarsInContent('echo ${PORT}', 'start.sh');
      expect(refs[0]?.name).toBe('PORT');
    });

    it('detects ${VAR} in Dockerfile', () => {
      const refs = detectVarsInContent('ENV APP_PORT=${PORT}', 'Dockerfile');
      expect(refs[0]?.name).toBe('PORT');
    });
  });
});
