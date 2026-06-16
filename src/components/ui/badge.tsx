import { cn, getStatusColor } from '@/lib/utils';
import { STATUS_LABELS } from '@/types';

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function Badge({ status, label, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', getStatusColor(status), className)}>
      {label || STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
    </span>
  );
}
