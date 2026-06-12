One side of a match — name, code, score, winner state. Set `pickable` to render it as a 44px-tall single-tap selector in the prediction flow.

```jsx
<TeamRow name="Brazil" code="BRA" score={3} isWinner />
<TeamRow name="Argentina" code="ARG" score={1} isLoser />
<TeamRow name="France" code="FRA" pickable picked onPick={() => {}} />
```
