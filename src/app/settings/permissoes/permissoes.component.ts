import { Component, OnInit }                   from '@angular/core';
import { CommonModule }                        from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule }        from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule }      from '@angular/material/snack-bar';
import { MatExpansionModule }                  from '@angular/material/expansion';
import { MatFormFieldModule }                  from '@angular/material/form-field';
import { MatSelectModule }                     from '@angular/material/select';
import { MatOptionModule }                     from '@angular/material/core';
import { environment } from '../../../environments/environment';

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
  private api = environment.apiUrl;

  constructor(
    private http:  HttpClient,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.http
      .get<Record<string,string[]>>(`${this.api}/settings/permissions`)
      .subscribe(obj => {
        this.modules = Object.keys(obj);
        for (const [mod, grps] of Object.entries(obj)) {
          this.form.addControl(mod, new FormControl(grps));
        }
      });

    this.http
      .get<string[]>(`${this.api}/settings/ad-groups`)
      .subscribe(gs => (this.allGroups = gs));
  }

  save(mod: string) {
    const groups = this.form.value[mod] as string[];
    this.http
      .put(`${this.api}/settings/permissions/${mod}`, { groups })
      .subscribe(() => {
        this.snack.open(`Permissões de ${mod} atualizadas ✨`, 'OK', { duration: 2_000 });
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
