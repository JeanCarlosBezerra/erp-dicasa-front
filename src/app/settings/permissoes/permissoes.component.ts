import { Component, OnInit }                   from '@angular/core';
import { CommonModule }                        from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule }        from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule }      from '@angular/material/snack-bar';
import { MatExpansionModule }                  from '@angular/material/expansion';
import { MatFormFieldModule }                  from '@angular/material/form-field';
import { MatSelectModule }                     from '@angular/material/select';
import { MatOptionModule }                     from '@angular/material/core';

@Component({
  standalone: true,
  selector: 'app-permissoes',
  templateUrl: './permissoes.component.html',
  styleUrls:   ['./permissoes.component.scss'],
  imports: [                                     // importa todos os módulos usados no template
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatSnackBarModule,
  ]
})
export class PermissoesComponent implements OnInit {
  modules:   string[]   = [];
  allGroups: string[]   = [];
  form:      FormGroup = new FormGroup({});    // <— sem generics aqui

  constructor(
    private http:  HttpClient,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.http
      .get<Record<string,string[]>>('/settings/permissions')
      .subscribe(obj => {
        this.modules = Object.keys(obj);
        for (const [mod, grps] of Object.entries(obj)) {
          // agora addControl encaixa sem reclamar
          this.form.addControl(mod, new FormControl(grps));
        }
      });

    this.http
      .get<string[]>('/settings/ad-groups')
      .subscribe(gs => this.allGroups = gs);
  }

  save(mod: string) {
    // e aqui pegamos valor também de forma simples
    const groups = this.form.get(mod)?.value as string[] || [];
    this.http
      .put(`/settings/permissions/${mod}`, { groups })
      .subscribe(() => {
        this.snack.open(`Permissões de ${mod} salvas.`, 'OK', { duration:2000 });
      });
  }

  shortName(dn: string): string {
    const m = dn.match(/CN=([^,]+)/i);
    return m ? m[1] : dn;
  }

  displayName(mod: string): string {
    return mod.replace(/\./g,' / ');
  }
}
