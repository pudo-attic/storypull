
all: fixtures

fixtures:
	curl -XPOST -H "Content-Type: application/json" --data @fixtures.json http://localhost:3000/api/import
	curl -XPOST -H "Content-Type: application/json" --data @demo_fixture.json http://storypull.herokuapp.com/api/import