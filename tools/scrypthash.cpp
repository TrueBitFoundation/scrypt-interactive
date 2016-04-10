#include <iostream>
#include <iomanip>
#include <fstream>
#include <sstream>
#include <vector>
#include "scrypt.h"

template <typename Container>
std::string toHex(Container const& _data)
{
	std::ostringstream ret;
	ret << std::hex << std::setfill('0') << std::setw(2);
	for (auto i: _data)
		ret << int(typename std::make_unsigned<decltype(i)>::type(i));
	return ret.str();
}

int main(int argc, char *argv[])
{
	std::ostringstream std_input;
	std_input << std::cin.rdbuf();
	std::string indata = std_input.str();

	char out[32];

	scrypt_1024_1_1_256(indata.data(), &out[0]);

	std::cout << toHex(out);
}
