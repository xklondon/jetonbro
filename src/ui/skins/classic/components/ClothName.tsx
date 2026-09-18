export function ClothName({ name }: { name: string }) {
  return (
    <p className="cloth-name" data-table-name={name}>
      {name}
    </p>
  );
}
