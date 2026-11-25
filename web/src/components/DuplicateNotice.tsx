export function DuplicateNotice({
  details,
}: {
  details: { participantId?: string; message?: string };
}) {
  return (
    <div className="duplicate-warning" role="alert">
      <div>
        <strong>
          {details.message ||
            "Бұл жазба бұрын тіркелген. Қайта қосуға болмайды."}
        </strong>
        {details.participantId && (
          <a
            className="button button-outline"
            href={`/participants/${details.participantId}`}
          >
            Бұрынғы жазбаны ашу
          </a>
        )}
      </div>
    </div>
  );
}
