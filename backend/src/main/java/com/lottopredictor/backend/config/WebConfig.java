package com.lottopredictor.backend.config;

import com.lottopredictor.backend.auth.AuthPrincipalArgumentResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] frontendOrigins;
    private final AuthPrincipalArgumentResolver authPrincipalArgumentResolver;

    public WebConfig(
            @Value("${lotto.frontend-origin}") String frontendOrigin,
            AuthPrincipalArgumentResolver authPrincipalArgumentResolver
    ) {
        this.frontendOrigins = frontendOrigin.split(",");
        this.authPrincipalArgumentResolver = authPrincipalArgumentResolver;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(frontendOrigins)
                .allowedMethods("GET", "POST")
                .allowedHeaders("*");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authPrincipalArgumentResolver);
    }
}
