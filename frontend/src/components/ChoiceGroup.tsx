import { useId } from "react";
import type { ReactNode } from "react";

export interface ChoiceOption<T extends string> {
  readonly value: T;
  /** The radio's accessible name. */
  readonly name: string;
  /** What the option shows; wrapped by the clickable label. */
  readonly content: ReactNode;
  /** Optional extra line, linked to the radio with aria-describedby. */
  readonly description?: string;
}

interface ChoiceGroupProps<T extends string> {
  /** Visible legend of the group. */
  legend: string;
  /** The group's accessible name when it differs from the visible legend. */
  groupName?: string;
  className: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
}

/**
 * A radio group drawn as a row of buttons: native radios keep the arrow keys,
 * one tab stop per group and the checked state for screen readers.
 */
export function ChoiceGroup<T extends string>({
  legend,
  groupName,
  className,
  value,
  options,
  onChange,
}: ChoiceGroupProps<T>) {
  const baseId = useId();
  return (
    <fieldset className={`choice-group ${className}`} aria-label={groupName}>
      <legend className="choice-legend">{legend}</legend>
      <div className="choice-options">
        {options.map((option) => {
          const checked = option.value === value;
          const descriptionId =
            option.description === undefined
              ? undefined
              : `${baseId}-${option.value}-description`;
          return (
            <label
              key={option.value}
              className={
                checked
                  ? "choice choice-checked touch-target"
                  : "choice touch-target"
              }
              data-value={option.value}
            >
              <input
                type="radio"
                className="choice-input"
                name={baseId}
                value={option.value}
                checked={checked}
                aria-label={option.name}
                aria-describedby={descriptionId}
                onChange={() => onChange(option.value)}
              />
              {option.content}
              {option.description === undefined ? null : (
                <span id={descriptionId} className="choice-description">
                  {option.description}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
