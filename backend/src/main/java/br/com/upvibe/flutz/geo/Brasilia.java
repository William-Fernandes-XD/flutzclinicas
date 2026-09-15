package br.com.upvibe.flutz.geo;

import java.math.BigDecimal;

public final class Brasilia {

    public static final BigDecimal LAT = new BigDecimal("-15.77972");
    public static final BigDecimal LNG = new BigDecimal("-47.92972");

    private Brasilia() {
    }

    public static BigDecimal latOrDefault(BigDecimal latitude) {
        return latitude == null ? LAT : latitude;
    }

    public static BigDecimal lngOrDefault(BigDecimal longitude) {
        return longitude == null ? LNG : longitude;
    }
}
