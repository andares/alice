import { describe, it, expect } from 'bun:test';
import { Card } from '../../../src/alice/components/card';
import { Field } from '../../../src/alice/components/field';
import { Modal } from '../../../src/alice/components/modal';
import { Menu } from '../../../src/alice/components/menu';
import { Pagination } from '../../../src/alice/components/pagination';
import { JsonTextarea } from '../../../src/alice/components/json-textarea';

describe('Card', () => {
  it('contains card class', () => {
    const output = Card({ title: 'Test', children: '<p>content</p>', color: 'info' });
    expect(output).toContain('card');
  });

  it('contains title text', () => {
    const output = Card({ title: 'Test', children: '<p>content</p>', color: 'info' });
    expect(output).toContain('Test');
  });

  it('contains border-l-4 class', () => {
    const output = Card({ title: 'Test', children: '<p>content</p>', color: 'info' });
    expect(output).toContain('border-l-4');
  });

  it('contains border-info class when color is info', () => {
    const output = Card({ title: 'Test', children: '<p>content</p>', color: 'info' });
    expect(output).toContain('border-info');
  });

  it('contains border-error class when color is error', () => {
    const output = Card({ title: 'Test', children: '<p>content</p>', color: 'error' });
    expect(output).toContain('border-error');
  });
});

describe('Field', () => {
  it('contains label-text', () => {
    const output = Field({ label: 'Name', value: 'John' });
    expect(output).toContain('label-text');
    expect(output).toContain('Name');
  });

  it('contains value', () => {
    const output = Field({ label: 'Name', value: 'John' });
    expect(output).toContain('John');
  });

  it('multiline mode uses textarea', () => {
    const output = Field({ label: 'Bio', value: 'line1\nline2', multiline: true });
    expect(output).toContain('<textarea');
  });

  it('non-multiline mode uses input', () => {
    const output = Field({ label: 'Name', value: 'John' });
    expect(output).toContain('<input');
    expect(output).not.toContain('<textarea');
  });
});

describe('Modal', () => {
  it('contains dialog element', () => {
    const output = Modal({ id: 'test-modal', title: 'Test Modal', children: '<p>content</p>' });
    expect(output).toContain('<dialog');
  });

  it('contains modal-box class', () => {
    const output = Modal({ id: 'test-modal', title: 'Test Modal', children: '<p>content</p>' });
    expect(output).toContain('modal-box');
  });

  it('contains modal-content id', () => {
    const output = Modal({ id: 'test-modal', title: 'Test Modal', children: '<p>content</p>' });
    expect(output).toContain('id="modal-content"');
  });

  it('contains close button', () => {
    const output = Modal({ id: 'test-modal', title: 'Test Modal', children: '<p>content</p>' });
    expect(output).toContain('✕');
  });
});

describe('Menu', () => {
  it('contains menu class', () => {
    const output = Menu({
      items: [{ label: 'Status', href: '/alice', icon: '📊' }],
      active: 'Status',
    });
    expect(output).toContain('menu');
  });

  it('contains menu item text', () => {
    const output = Menu({
      items: [{ label: 'Status', href: '/alice', icon: '📊' }],
      active: 'Status',
    });
    expect(output).toContain('Status');
  });

  it('active item has bg-primary class', () => {
    const output = Menu({
      items: [{ label: 'Status', href: '/alice', icon: '📊' }],
      active: 'Status',
    });
    expect(output).toContain('bg-primary');
  });

  it('inactive item has hover class instead of bg-primary', () => {
    const output = Menu({
      items: [{ label: 'Config', href: '/alice/config' }],
      active: 'Status',
    });
    expect(output).toContain('hover:bg-base-300');
    expect(output).not.toContain('bg-primary');
  });
});

describe('Pagination', () => {
  it('contains join class', () => {
    const output = Pagination({ current: 1, total: 5, baseUrl: '/alice/logs' });
    expect(output).toContain('join');
  });

  it('contains page number buttons', () => {
    const output = Pagination({ current: 1, total: 5, baseUrl: '/alice/logs' });
    expect(output).toContain('1');
    expect(output).toContain('2');
    expect(output).toContain('5');
  });

  it('disabled state has btn-disabled', () => {
    const output = Pagination({ current: 1, total: 5, baseUrl: '/alice/logs' });
    expect(output).toContain('btn-disabled');
  });

  it('zero total disables both buttons', () => {
    const output = Pagination({ current: 1, total: 0, baseUrl: '/alice/logs' });
    const disabledCount = (output.match(/btn-disabled/g) || []).length;
    expect(disabledCount).toBe(2);
  });
});

describe('JsonTextarea', () => {
  it('contains textarea', () => {
    const output = JsonTextarea({ content: '{"key": "value"}' });
    expect(output).toContain('<textarea');
  });

  it('formats valid JSON', () => {
    const output = JsonTextarea({ content: '{"key": "value"}' });
    expect(output).toContain('"key"');
    expect(output).toContain('"value"');
  });

  it('falls back to raw string on invalid JSON', () => {
    const output = JsonTextarea({ content: 'not json', label: 'Body' });
    expect(output).toContain('not json');
  });

  it('displays label when provided', () => {
    const output = JsonTextarea({ content: 'not json', label: 'Body' });
    expect(output).toContain('Body');
  });
});
