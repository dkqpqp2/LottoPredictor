package com.lottopredictor.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthPrincipalArgumentResolverTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private NativeWebRequest webRequest;

    @Mock
    private HttpServletRequest servletRequest;

    @Test
    void resolvesTheAuthenticatedUserFromAValidBearerToken() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn("Bearer valid-token");
        when(jwtService.parse("valid-token")).thenReturn(Optional.of(new AuthenticatedUser(1L, "홍길동")));

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);
        Object result = resolver.resolveArgument(null, null, webRequest, null);

        assertThat(result).isEqualTo(new AuthenticatedUser(1L, "홍길동"));
    }

    @Test
    void throwsUnauthorizedWhenTheHeaderIsMissing() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn(null);

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, webRequest, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void throwsUnauthorizedWhenTheTokenIsInvalid() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn("Bearer bad-token");
        when(jwtService.parse("bad-token")).thenReturn(Optional.empty());

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, webRequest, null))
                .isInstanceOf(ResponseStatusException.class);
    }
}
