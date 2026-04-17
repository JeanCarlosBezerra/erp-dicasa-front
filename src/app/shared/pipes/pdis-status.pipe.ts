import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'pdisStatus', standalone: true })
export class PdisStatusPipe implements PipeTransform {
  transform(pdis: any[], status: string): number {
    return pdis.filter(p => p.status === status).length;
  }
}