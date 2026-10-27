import { STATUS_LABEL, STATUS_TONE, type Status } from "@/lib/labels";
export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
