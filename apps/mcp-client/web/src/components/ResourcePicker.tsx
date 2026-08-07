import { useEffect, useId, useState } from 'react';
import { readResource } from '../api';
import type { ResourceInfo } from '../types';
import './ResourcePicker.css';

type ResourcePickerProps = {
  resources: ResourceInfo[];
  disabled?: boolean;
  onInject: (message: string) => void;
};

export function ResourcePicker({
  resources,
  disabled = false,
  onInject,
}: ResourcePickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ResourceInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [injectMessage, setInjectMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading]);

  const close = () => {
    if (loading) {
      return;
    }
    setOpen(false);
    setSelected(null);
    setPreview(null);
    setInjectMessage(null);
    setError(null);
  };

  const openPicker = () => {
    if (disabled || resources.length === 0) {
      return;
    }
    setOpen(true);
    setSelected(null);
    setPreview(null);
    setInjectMessage(null);
    setError(null);
  };

  const selectResource = async (resource: ResourceInfo) => {
    setSelected(resource);
    setError(null);
    setPreview(null);
    setInjectMessage(null);
    setLoading(true);
    try {
      const result = await readResource(resource.uri);
      setPreview(result.text);
      setInjectMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInject = () => {
    if (!injectMessage || loading) {
      return;
    }
    onInject(injectMessage);
    setOpen(false);
    setSelected(null);
    setPreview(null);
    setInjectMessage(null);
    setError(null);
  };

  const canOpen = !disabled && resources.length > 0;

  return (
    <>
      <button
        type="button"
        className="resource-picker-trigger"
        onClick={openPicker}
        disabled={!canOpen}
        title={
          resources.length === 0
            ? 'No MCP resources available'
            : 'Browse MCP knowledge resources'
        }
      >
        Resources
      </button>

      {open ? (
        <div className="resource-picker-backdrop" onClick={close}>
          <div
            className="resource-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resource-picker-header">
              <h2 id={titleId}>
                {selected ? (selected.title ?? selected.name) : 'MCP Resources'}
              </h2>
              <button
                type="button"
                className="resource-picker-close"
                onClick={close}
                aria-label="Close"
                disabled={loading}
              >
                ×
              </button>
            </div>

            {!selected ? (
              <div className="resource-picker-list">
                <p className="resource-picker-intro">
                  Choose a server knowledge document. Preview it, then inject
                  the content into the chat.
                </p>
                {resources.map((resource) => (
                  <button
                    key={resource.uri}
                    type="button"
                    className="resource-picker-item"
                    onClick={() => void selectResource(resource)}
                  >
                    <span className="resource-picker-item-title">
                      {resource.title ?? resource.name}
                    </span>
                    {resource.description ? (
                      <span className="resource-picker-item-desc">
                        {resource.description}
                      </span>
                    ) : null}
                    <span className="resource-picker-item-uri">
                      {resource.uri}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="resource-picker-detail">
                {selected.description ? (
                  <p className="resource-picker-intro">{selected.description}</p>
                ) : null}
                <p className="resource-picker-item-uri">{selected.uri}</p>

                {loading ? (
                  <p className="resource-picker-intro">Loading…</p>
                ) : null}

                {error ? (
                  <p className="resource-picker-error" role="alert">
                    {error}
                  </p>
                ) : null}

                {preview !== null && !loading ? (
                  <pre className="resource-picker-preview">{preview}</pre>
                ) : null}

                <div className="resource-picker-actions">
                  <button
                    type="button"
                    className="resource-picker-secondary"
                    onClick={() => {
                      setSelected(null);
                      setPreview(null);
                      setInjectMessage(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="resource-picker-primary"
                    onClick={handleInject}
                    disabled={loading || !injectMessage}
                  >
                    Insert into chat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
