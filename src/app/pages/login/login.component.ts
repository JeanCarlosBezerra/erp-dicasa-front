import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@app/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ]
})
export class LoginComponent {
  usuario = '';
  senha = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  logar() {
  this.authService.login(this.usuario, this.senha).subscribe({
    next: (res) => {
      if (res.sucesso) {
        localStorage.setItem('usuario', res.usuario.NOMEUSUARIO);
        console.log('✅ Login bem-sucedido', res.usuario);
        this.router.navigate(['/menu']); // ⬅ Aqui redireciona para a tela de menu
      } else {
        alert('❌ Usuário ou senha inválidos');
      }
    },
    error: (err) => {
      console.error('❌ Erro ao tentar logar:', err);
      alert('Erro de conexão com o servidor.');
    }
  });
}
  
}
