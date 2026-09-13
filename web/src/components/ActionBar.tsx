import type { AllowedAction } from '../api.js';

export function ActionBar({
  actions,
  disabled,
  onAction,
}: {
  actions: AllowedAction[];
  disabled?: boolean;
  onAction: (action: AllowedAction) => void;
}) {
  if (actions.length === 0) {
    return <p className="muted">No actions for your role in this phase.</p>;
  }
  return (
    <div className="action-bar" data-testid="action-bar">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={disabled}
          data-action={action.id}
          onClick={() => onAction(action)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
