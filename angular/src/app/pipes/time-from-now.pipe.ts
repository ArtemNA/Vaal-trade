import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeFromNow',
  standalone: false
})
export class TimeFromNowPipe implements PipeTransform {
  transform(value: string | Date): string {
    const now = new Date();
    const target = new Date(value);
    const diffInSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);

    if (isNaN(target.getTime())) {
      throw new Error('Invalid date format. Please provide a valid date.');
    }

    const units = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
      { label: 'second', seconds: 1 }
    ];

    const isPast = diffInSeconds < 0;
    const diff = Math.abs(diffInSeconds);

    for (const unit of units) {
      if (diff >= unit.seconds) {
        const count = Math.floor(diff / unit.seconds);
        return `${count} ${unit.label}${count !== 1 ? 's' : ''} ${isPast ? 'ago' : 'from now'}`;
      }
    }

    return 'Just now';
  }
}
