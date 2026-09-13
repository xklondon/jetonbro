/**
 * Display aid only. The file is stored and shown as-is — no OCR, parse, or score.
 */
export function HandDisplayField({
  text,
  photo,
  editable,
  onSave,
}: {
  text: string;
  photo: string;
  editable: boolean;
  onSave?: (next: { text: string; photo: string }) => void;
}) {
  return (
    <section className="hand-display" data-testid="hand-display">
      <h2>Hand (display only)</h2>
      {editable ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const nextText = (form.elements.namedItem('hand-text') as HTMLTextAreaElement).value;
            onSave?.({ text: nextText, photo });
          }}
        >
          <textarea name="hand-text" defaultValue={text} rows={3} placeholder="Type what is on the table" />
          <label>
            Photo
            <input
              name="hand-photo"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !onSave) {
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  onSave({ text, photo: String(reader.result ?? '') });
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <button type="submit">Save display</button>
        </form>
      ) : null}
      {text ? <p data-testid="hand-text">{text}</p> : null}
      {photo ? <img data-testid="hand-photo" src={photo} alt="Hand display aid" /> : null}
    </section>
  );
}
