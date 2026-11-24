/** The two small stickers beside the name. */
export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export function Brand() {
  return (
    <a className="brand" href="/">
      <Mark />
      <span>یه بیت</span>
    </a>
  );
}
