import { Component, ViewEncapsulation  } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../services/auth.service';  // ajuste o path

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MatSidenavModule,
            MatButtonModule,
            MatIconModule,
            MatDividerModule,
            MatExpansionModule, 
            RouterModule,
            CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})


export class Menu {
  usuario: string = '';
  menuIcon: string = 'menu';
  opened: boolean = window.innerWidth > 768; 

  constructor(public authService: AuthService, private router: Router, private themeService: ThemeService) {}

  go(path: string) {
    this.router.navigateByUrl(path);
  }
  
  ngOnInit() {
    this.usuario = localStorage.getItem('usuario') ?? 'Usuário';
  }

  toggleSidenav(sidenav: any) {
    sidenav.toggle();
    this.menuIcon = sidenav.opened ? 'close' : 'menu';
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logout() {
  // Se estiver usando localStorage futuramente, limpe aqui
  // localStorage.removeItem('usuario');
    
  this.router.navigate(['/login']);
}
}
