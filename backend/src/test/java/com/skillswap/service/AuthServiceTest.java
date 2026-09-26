package com.skillswap.service;

import com.skillswap.dto.auth.AuthResponse;
import com.skillswap.dto.auth.LoginRequest;
import com.skillswap.dto.auth.RefreshRequest;
import com.skillswap.dto.auth.SignupRequest;
import com.skillswap.entity.User;
import com.skillswap.exception.BadRequestException;
import com.skillswap.exception.DuplicateResourceException;
import com.skillswap.exception.UnauthorizedException;
import com.skillswap.repository.UserRepository;
import com.skillswap.security.JwtTokenProvider;
import com.skillswap.security.UserDetailsServiceImpl;
import com.skillswap.security.UserPrincipal;
import com.skillswap.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private UserDetailsServiceImpl userDetailsService;

    @InjectMocks
    private AuthServiceImpl authService;

    private User sampleUser;
    private UserPrincipal samplePrincipal;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(1L)
                .name("Jane Doe")
                .email("jane@example.com")
                .passwordHash("encodedPassword")
                .build();

        samplePrincipal = UserPrincipal.create(sampleUser);
    }

    @Test
    void signup_ShouldReturnAuthResponse_WhenValidRequest() {
        SignupRequest request = SignupRequest.builder()
                .name("Jane Doe")
                .email("jane@example.com")
                .password("password123")
                .build();

        when(userRepository.existsByEmail("jane@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(tokenProvider.generateAccessToken(any(UserPrincipal.class))).thenReturn("access-token");
        when(tokenProvider.generateRefreshToken(any(UserPrincipal.class))).thenReturn("refresh-token");
        when(tokenProvider.getAccessExpirationMs()).thenReturn(900000L);

        AuthResponse response = authService.signup(request);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getExpiresIn()).isEqualTo(900L);
        verify(userRepository).save(any(User.class));
    }

    @Test
    void signup_ShouldThrowDuplicateResourceException_WhenEmailAlreadyExists() {
        SignupRequest request = SignupRequest.builder()
                .name("Jane Doe")
                .email("jane@example.com")
                .password("password123")
                .build();

        when(userRepository.existsByEmail("jane@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("already exists");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void login_ShouldReturnAuthResponse_WhenCredentialsAreValid() {
        LoginRequest request = LoginRequest.builder()
                .email("jane@example.com")
                .password("password123")
                .build();

        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(samplePrincipal);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(auth);
        when(tokenProvider.generateAccessToken(samplePrincipal)).thenReturn("access-token");
        when(tokenProvider.generateRefreshToken(samplePrincipal)).thenReturn("refresh-token");
        when(tokenProvider.getAccessExpirationMs()).thenReturn(900000L);

        AuthResponse response = authService.login(request);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
    }

    @Test
    void login_ShouldThrowBadCredentialsException_WhenCredentialsAreInvalid() {
        LoginRequest request = LoginRequest.builder()
                .email("jane@example.com")
                .password("wrongpassword")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void refresh_ShouldReturnNewTokens_WhenValidRefreshToken() {
        RefreshRequest request = RefreshRequest.builder()
                .refreshToken("valid-refresh-token")
                .build();

        when(tokenProvider.validateToken("valid-refresh-token")).thenReturn(true);
        when(tokenProvider.getTokenTypeFromToken("valid-refresh-token")).thenReturn("REFRESH");
        when(tokenProvider.getEmailFromToken("valid-refresh-token")).thenReturn("jane@example.com");
        when(userDetailsService.loadUserByUsername("jane@example.com")).thenReturn(samplePrincipal);
        when(tokenProvider.generateAccessToken(samplePrincipal)).thenReturn("new-access-token");
        when(tokenProvider.generateRefreshToken(samplePrincipal)).thenReturn("new-refresh-token");
        when(tokenProvider.getAccessExpirationMs()).thenReturn(900000L);

        AuthResponse response = authService.refresh(request);

        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
    }

    @Test
    void refresh_ShouldThrowUnauthorized_WhenTokenInvalid() {
        RefreshRequest request = RefreshRequest.builder()
                .refreshToken("invalid-token")
                .build();

        when(tokenProvider.validateToken("invalid-token")).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Invalid or expired");
    }

    @Test
    void refresh_ShouldThrowBadRequest_WhenNotRefreshToken() {
        RefreshRequest request = RefreshRequest.builder()
                .refreshToken("access-token-passed-as-refresh")
                .build();

        when(tokenProvider.validateToken(any())).thenReturn(true);
        when(tokenProvider.getTokenTypeFromToken(any())).thenReturn("ACCESS");

        assertThatThrownBy(() -> authService.refresh(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not a refresh token");
    }
}
