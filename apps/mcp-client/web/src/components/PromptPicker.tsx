import { useEffect, useId, useState, type FormEvent } from 'react';
import { getPrompt } from '../api';
import type { PromptInfo } from '../types';
import './PromptPicker.css';

type PromptPickerProps = {
  prompts: PromptInfo[];
  disabled?: boolean;
  onInject: (message: string) => void;
};

export function PromptPicker({
  prompts,
  disabled = false,
  onInject,
}: PromptPickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PromptInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting]);

  const close = () => {
    if (submitting) {
      return;
    }
    setOpen(false);
    setSelected(null);
    setValues({});
    setError(null);
  };

  const openPicker = () => {
    if (disabled || prompts.length === 0) {
      return;
    }
    setOpen(true);
    setSelected(null);
    setValues({});
    setError(null);
  };

  const selectPrompt = (prompt: PromptInfo) => {
    setSelected(prompt);
    setError(null);
    const initial: Record<string, string> = {};
    for (const arg of prompt.arguments ?? []) {
      initial[arg.name] = '';
    }
    setValues(initial);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || submitting) {
      return;
    }

    for (const arg of selected.arguments ?? []) {
      if (arg.required !== false && !values[arg.name]?.trim()) {
        setError(`"${arg.name}" is required`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await getPrompt(selected.name, values);
      onInject(result.message);
      setOpen(false);
      setSelected(null);
      setValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canOpen = !disabled && prompts.length > 0;

  return (
    <>
      <button
        type="button"
        className="prompt-picker-trigger"
        onClick={openPicker}
        disabled={!canOpen}
        title={
          prompts.length === 0
            ? 'No MCP prompts available'
            : 'Insert an MCP prompt template'
        }
      >
        Prompts
      </button>

      {open ? (
        <div className="prompt-picker-backdrop" onClick={close}>
          <div
            className="prompt-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="prompt-picker-header">
              <h2 id={titleId}>
                {selected
                  ? (selected.title ?? selected.name)
                  : 'MCP Prompts'}
              </h2>
              <button
                type="button"
                className="prompt-picker-close"
                onClick={close}
                aria-label="Close"
                disabled={submitting}
              >
                ×
              </button>
            </div>

            {!selected ? (
              <div className="prompt-picker-list">
                <p className="prompt-picker-intro">
                  Choose a server-defined prompt template. Fill its arguments,
                  then inject the expanded message into the chat.
                </p>
                {prompts.map((prompt) => (
                  <button
                    key={prompt.name}
                    type="button"
                    className="prompt-picker-item"
                    onClick={() => selectPrompt(prompt)}
                  >
                    <span className="prompt-picker-item-title">
                      {prompt.title ?? prompt.name}
                    </span>
                    {prompt.description ? (
                      <span className="prompt-picker-item-desc">
                        {prompt.description}
                      </span>
                    ) : null}
                    <span className="prompt-picker-item-name">
                      {prompt.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <form className="prompt-picker-form" onSubmit={(e) => void handleSubmit(e)}>
                {selected.description ? (
                  <p className="prompt-picker-intro">{selected.description}</p>
                ) : null}

                {(selected.arguments ?? []).map((arg) => {
                  const required = arg.required !== false;
                  return (
                    <label key={arg.name} className="prompt-picker-field">
                      <span className="prompt-picker-label">
                        {arg.name}
                        {required ? (
                          <span className="prompt-picker-required">*</span>
                        ) : (
                          <span className="prompt-picker-optional">
                            optional
                          </span>
                        )}
                      </span>
                      {arg.description ? (
                        <span className="prompt-picker-field-hint">
                          {arg.description}
                        </span>
                      ) : null}
                      <input
                        type={arg.name === 'amount' ? 'number' : 'text'}
                        step={arg.name === 'amount' ? 'any' : undefined}
                        value={values[arg.name] ?? ''}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [arg.name]: event.target.value,
                          }))
                        }
                        disabled={submitting}
                        required={required}
                        autoComplete="off"
                      />
                    </label>
                  );
                })}

                {error ? (
                  <p className="prompt-picker-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="prompt-picker-actions">
                  <button
                    type="button"
                    className="prompt-picker-secondary"
                    onClick={() => {
                      setSelected(null);
                      setValues({});
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="prompt-picker-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Loading…' : 'Use prompt'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
