export function ClothName({ name }: { name: string }) {
  return (
    <p className="cloth-name" data-table-name={name}>
      <span className="cloth-name-text">{name}</span>
      <i className="cloth-name-rule" aria-hidden="true" />
    </p>
  );
}
