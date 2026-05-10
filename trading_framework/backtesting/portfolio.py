from .models import EquityPoint, Trade


class Portfolio:
    def __init__(self, starting_cash: float) -> None:
        self.cash = float(starting_cash)
        self.position = 0

    def buy(self, index: int, price: float, position_size_pct: float, fee_rate: float) -> Trade | None:
        budget = self.cash * position_size_pct
        quantity = int(budget // price)
        if quantity <= 0:
            return None

        gross_total = quantity * price
        fee = gross_total * fee_rate
        net_total = gross_total + fee
        if net_total > self.cash:
            quantity = int(self.cash // (price * (1 + fee_rate)))
            if quantity <= 0:
                return None
            gross_total = quantity * price
            fee = gross_total * fee_rate
            net_total = gross_total + fee

        self.cash -= net_total
        self.position += quantity

        return Trade(index, "BUY", quantity, round(price, 2), round(gross_total, 2), round(fee, 2), round(net_total, 2))

    def sell(self, index: int, price: float, fee_rate: float) -> Trade:
        quantity = self.position
        gross_total = quantity * price
        fee = gross_total * fee_rate
        net_total = gross_total - fee

        self.cash += net_total
        self.position = 0

        return Trade(index, "SELL", quantity, round(price, 2), round(gross_total, 2), round(fee, 2), round(net_total, 2))

    def value(self, price: float) -> float:
        return self.cash + self.position * price

    def mark_to_market(self, index: int, price: float) -> EquityPoint:
        return EquityPoint(
            index=index,
            cash=round(self.cash, 2),
            position=self.position,
            price=round(price, 2),
            value=round(self.value(price), 2),
        )
