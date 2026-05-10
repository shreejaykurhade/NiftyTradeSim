def percentage_fee(gross_total: float, fee_rate: float) -> float:
    if gross_total < 0:
        raise ValueError("gross_total cannot be negative")
    if fee_rate < 0:
        raise ValueError("fee_rate cannot be negative")
    return gross_total * fee_rate
