import { Badge } from "@/components/ui/badge";

interface JournalBadgeProps {
  name: string;
  abbreviation: string;
  color: string;
}

export function JournalBadge({ abbreviation, color }: JournalBadgeProps) {
  return (
    <Badge color={color}>
      {abbreviation}
    </Badge>
  );
}
