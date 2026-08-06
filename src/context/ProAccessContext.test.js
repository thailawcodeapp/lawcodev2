import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const mockResult = {
  isPro: true, state: 'pro', playStoreActive: true,
  user: { uid: 'u1' }, devices: [{ id: 'd1' }], myDeviceId: 'd1',
  revokeDevice: vi.fn(),
};
const useEffectiveProMock = vi.fn(() => mockResult);
vi.mock('../hooks/useEffectivePro', () => ({ useEffectivePro: useEffectiveProMock }));

const { ProAccessProvider, useProAccess } = await import('./ProAccessContext');

function Probe() {
  const access = useProAccess();
  return createElement('div', null, JSON.stringify({ isPro: access.isPro, state: access.state }));
}

describe('ProAccessProvider', () => {
  it('calls useEffectivePro exactly once regardless of how many descendants read it', () => {
    useEffectiveProMock.mockClear();
    const tree = createElement(ProAccessProvider, null,
      createElement(Probe), createElement(Probe), createElement(Probe));
    renderToStaticMarkup(tree);
    // Three Probes each call useProAccess(); only the Provider itself may call
    // the real hook — that is the entire point of lifting it out of each
    // consumer, since useEffectivePro mounts a Firebase auth listener and a
    // Firestore device-list fetch.
    expect(useEffectiveProMock).toHaveBeenCalledTimes(1);
  });

  it('gives every descendant the same value the hook returned', () => {
    const tree = createElement(ProAccessProvider, null, createElement(Probe));
    const html = renderToStaticMarkup(tree);
    // renderToStaticMarkup HTML-escapes quote characters in text nodes
    // (&quot; not "), so assert against the escaped form.
    expect(html).toContain('&quot;isPro&quot;:true');
    expect(html).toContain('&quot;state&quot;:&quot;pro&quot;');
  });

  it('throws a clear error when used outside the provider, not a silent undefined', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/useProAccess/);
  });
});
